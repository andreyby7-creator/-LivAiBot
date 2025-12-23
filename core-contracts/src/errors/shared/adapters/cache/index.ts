/**
 * @file index.ts - Реэкспорты Cache адаптера
 */

// Основной API
export * from './CacheAdapter.js';

// Типы
export * from './CacheAdapterTypes.js';

// Фабрики для создания типов
export * from './CacheAdapterFactories.js';

// Объект со всеми фабриками для удобного импорта
export { cacheAdapterFactories, CacheAdapterValidationError } from './CacheAdapterFactories.js';

// Конфигурация
export * from './CacheAdapterConfig.js';

// Effect pipeline (для продвинутого использования)
export * from './CacheAdapterEffect.js';
