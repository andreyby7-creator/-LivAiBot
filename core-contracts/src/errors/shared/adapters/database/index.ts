/**
 * @file index.ts - Реэкспорты Database адаптера
 */

// Основной API
export * from './DatabaseAdapter.js';

// Типы
export * from './DatabaseAdapterTypes.js';

// Фабрики для создания типов
export * from './DatabaseAdapterFactories.js';

// Объект со всеми фабриками для удобного импорта
export {
  databaseAdapterFactories,
  DatabaseAdapterValidationError,
} from './DatabaseAdapterFactories.js';

// Конфигурация
export * from './DatabaseAdapterConfig.js';

// Effect pipeline (для продвинутого использования)
export * from './DatabaseAdapterEffect.js';
