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

/* ============================================================================
 * 🔧 SESSION STATE BUILDER — ПОСТРОЕНИЕ СЕССИИ
 * ========================================================================== */

/**
 * Session State Builder: единая точка построения SessionState.
 * Используется во всех auth-эффектах (login/register/refresh) для консистентности.
 *
 * @public
 */
export type { BuildSessionStateParams } from './session-state.builder.js';
export { buildSessionState } from './session-state.builder.js';

/* ============================================================================
 * 🔧 AUTH API MAPPERS — ОБЩИЕ МЭППЕРЫ
 * ========================================================================== */

/**
 * Auth API Mappers: общие мэпперы для преобразования transport → domain.
 * Используются во всех auth-эффектах (login/register/refresh) для консистентности.
 *
 * @public
 */
export { mapMeResponseValuesToDomain, mapTokenPairValuesToDomain } from './auth-api.mappers.js';
