/**
 * @fileoverview Конфигурация Prettier для LivAI
 * Единая система форматирования кода для монорепозитория LivAI
 * Обеспечивает консистентность и читаемость во всем проекте
 */

export default {
  // Основное форматирование
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // Завершающие запятые
  trailingComma: 'es5',

  // Скобки и пробелы
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',

  // Окончания строк
  endOfLine: 'lf',

  // Переопределения для конкретных типов файлов
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
      },
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
      },
    },
  ],
};
