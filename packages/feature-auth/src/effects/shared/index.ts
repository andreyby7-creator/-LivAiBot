/**
 * @file packages/feature-auth/src/effects/shared — Shared Effects Utilities
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
 * @public
 */
export { mapMeResponseValuesToDomain, mapTokenPairValuesToDomain } from './auth-api.mappers.js';

/* ============================================================================
 * 🔧 API CLIENT PORT — ЕДИНЫЙ КОНТРАКТ HTTP-КЛИЕНТА
 * ========================================================================== */

/**
 * AuthApiClient Port: Effect-based DI-контракт для HTTP-клиента auth-домена.
 * Обеспечивает единую async-модель в orchestrator.
 * @public
 */
export type { ApiRequestOptions, AuthApiClientPort } from './api-client.port.js';

/* ============================================================================
 * 🔧 API CLIENT ADAPTER — АДАПТАЦИЯ PROMISE → EFFECT
 * ========================================================================== */

/**
 * ApiClient Adapter: преобразование Promise-based HTTP-клиента в Effect-based AuthApiClientPort.
 * Используется во всех auth-эффектах для единой async-модели в orchestrator.
 * @public
 */
export type { LegacyApiClient } from './api-client.adapter.js';
export { createApiClientPortAdapter } from './api-client.adapter.js';
