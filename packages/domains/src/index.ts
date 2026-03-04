/**
 * @file @livai/domains — Public API для Domains пакета
 * Публичный API пакета @livai/domains.
 * Экспортирует все публичные компоненты, типы и утилиты для domain-specific логики.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 * Архитектурные принципы:
 * - Один домен = один подпакет
 * - Публичный API через index.ts
 * - Внутренние модули (signals, strategies, providers) НЕ экспортируются
 * - Домены независимы друг от друга
 */

/* ============================================================================
 * 🎯 CLASSIFICATION — CLASSIFICATION DOMAIN
 * ============================================================================
 */

/**
 * Classification Domain подпакет: domain-specific labels для classification.
 * Включает ClassificationLabel (value object), classificationLabelUtils (pure helpers),
 * classificationPolicy (business logic через declarative policy map).
 * Использует generic Label<T> из @livai/core/domain-kit для type safety.
 * @public
 */
export * from './classification/index.js';
