/**
 * @file packages/core/src/feature-flags/index.ts
 * ============================================================================
 * 🚩 CORE — Feature Flags (Public API)
 * ============================================================================
 * Публичный API feature flags engine (core-only).
 * React-части экспортируются отдельным subpath модулем `@livai/core/feature-flags/react`.
 */

/* ============================================================================
 * 🧠 CORE ENGINE — DETERMINISTIC FEATURE FLAGS (NO REACT)
 * ========================================================================== */

/**
 * Core engine для feature flags:
 * - types, strategies, evaluation, providers
 * - без React/env/console зависимостей (platform-neutral)
 * @public
 */

export * from './core.js';
