/**
 * @file ErrorStrategies.ts - Enterprise-grade стратегии обработки ошибок LivAiBot
 *
 * Grouping по префиксам, composition-based архитектура, pure функции.
 * 19 групповых стратегий вместо individual codes, Effect integration для circuit breaker.
 * Strategy resolution pipeline: custom → grouped → severity-based fallback.
 * Custom стратегии с явным mapping через applicableCodes для надежности.
 * Enterprise alert система через Effect Context для Sentry/Prometheus интеграции.
 * Поддержка асинхронных стратегий: Promise, Effect, callback-based.
 *
 * Архитектура: модульная структура в папке ErrorStrategies/
 */

// Реэкспорт из модульной структуры
export * from './ErrorStrategies/index.js';
