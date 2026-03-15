/**
 * @file packages/feature-auth/src/contracts — Contracts
 * Публичный API контрактов feature-auth для API boundary.
 */

/* ============================================================================
 * 📜 AUTH CONTRACTS — КОНТРАКТЫ ДЛЯ API BOUNDARY
 * ============================================================================
 */

/**
 * AuthErrorResponse: нормализованный контракт ошибок аутентификации.
 * @public
 */
export { type AuthErrorResponse, type AuthErrorType } from './AuthErrorResponse.js';

/**
 * OAuthErrorResponse: нормализованный контракт ошибок OAuth аутентификации.
 * @public
 */
export {
  type OAuthErrorResponse,
  type OAuthErrorType,
  type OAuthProvider,
} from './OAuthErrorResponse.js';
