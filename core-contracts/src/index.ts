/**
 * @file index.ts - Entry point всего пакета @livai/core-contracts
 *
 * Core Contracts - фундаментальный слой для эффектов, аутентификации,
 * домена, ошибок и инфраструктурных контрактов.
 * Объединяет крупные модули в единый пакетный API.
 */

// ==================== МОДУЛЬ ОШИБОК ====================

/**
 * Errors: enterprise-grade система ошибок с discriminated union архитектурой
 * - 5 групп API: Types, Builders, Utils, Validators, Strategies
 * - Deep immutability guarantee, circular reference protection
 * - Performance optimizations с lazy evaluation и memoization
 */
export * as Errors from './errors/index.js';

// ==================== БУДУЩИЕ МОДУЛИ ====================

/**
 * Metrics: система метрик и мониторинга (будет реализовано)
 * - Интерфейсы для метрик, incrementErrorCounter, observeLatency
 * - Абстракция над конкретными системами метрик
 */
// export * as Metrics from './metrics/index.js';

/**
 * Observability: инструменты наблюдаемости (будет реализовано)
 * - logError, sendToTelemetry, mapErrorToSeverityMetric
 * - Tracing и distributed debugging support
 */
// export * as Observability from './observability/index.js';

/**
 * IO: контракты ввода-вывода (будет реализовано)
 * - Network, filesystem, database abstractions
 * - Effect-native IO operations
 */
// export * as IO from './io/index.js';

/**
 * FP: функциональное программирование утилиты (будет реализовано)
 * - Pure functions, immutable data structures
 * - Composition helpers для functional-first подхода
 */
// export * as FP from './fp/index.js';

/**
 * Domain: доменные контракты (будет реализовано)
 * - Core business entities, value objects
 * - Domain services и business logic contracts
 */
// export * as Domain from './domain/index.js';

/**
 * Context: dependency injection и контекст (будет реализовано)
 * - Effect context, service locator
 * - Configuration management и runtime context
 */
// export * as Context from './context/index.js';
