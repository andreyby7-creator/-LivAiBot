const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}', // Все страницы (Next.js 16)
    './src/components/**/*.{js,ts,jsx,tsx,mdx}', // Все компоненты
    '../../packages/ui-*/src/**/*.{js,ts,jsx,tsx}', // UI пакеты монорепо
    '../../packages/feature-*/src/**/*.{js,ts,jsx,tsx}', // Feature пакеты монорепо
  ],
  theme: {
    extend: {}, // Кастомизация цветов, spacing, шрифтов
  },
  plugins: [], // Можно добавить forms, typography и т.д.
};

export default config;
