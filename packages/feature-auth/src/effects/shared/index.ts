/**
 * @file packages/feature-auth/src/effects/shared — Shared Effects Utilities
 *
 * Публичный API пакета shared effects.
 * Экспортирует общие утилиты для всех auth-эффектов.
 */

/* ============================================================================
 * 🔐 AUTH STORE PORT — ЕДИНЫЙ КОНТРАКТ СТОРА
 * ========================================================================== */

/**
 * Auth Store Port: единый контракт стора для всех auth-эффектов.
 * Абстрагирует Zustand store, гарантирует атомарность через batchUpdate,
 * изолирует effects от деталей реализации.
 *
 * @public
 */
export {
  type AuthStorePort,
  type BatchUpdate,
  createAuthStorePortAdapter,
  isBatchUpdateOfType,
  withStoreLock,
} from './auth-store.port.js';
