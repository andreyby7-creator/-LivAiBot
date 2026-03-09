/**
 * @file packages/core/src/performance/index.ts
 * ============================================================================
 * 🚀 PERFORMANCE — Public API (Core Only)
 * ============================================================================
 * Публичный API performance core (core-only).
 * React-части экспортируются отдельным subpath модулем `@livai/core/performance/react`.
 */

/* ============================================================================
 * 🧠 CORE ENGINE — PERFORMANCE TRACKING (NO REACT)
 * ========================================================================== */

/**
 * Core engine для performance tracking:
 * - types, tracker, batcher, thresholds
 * - без React/DOM зависимостей (platform-neutral)
 * @public
 */

export * from './core.js';
