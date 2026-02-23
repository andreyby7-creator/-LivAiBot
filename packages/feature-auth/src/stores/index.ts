/**
 * @file packages/feature-auth/src/stores — Stores
 *
 * Публичный API пакета stores.
 * Экспортирует все публичные хранилища для feature-auth.
 */

/* ============================================================================
 * 🔐 AUTH STORE — ХРАНИЛИЩЕ АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Auth Store: хранилище состояния аутентификации.
 * Включает создание, валидацию, восстановление и все связанные типы и функции.
 *
 * @public
 */
export {
  authStoreVersion,
  createInitialAuthStoreState,
  enforceInvariants,
  validateAuthSemantics,
  validateSessionSemantics,
  validateSecuritySemantics,
  restoreAuthFromPersisted,
  validatePersistedState,
  createAuthStore,
  getAuth,
  getMfa,
  getOAuth,
  getSecurity,
  getSession,
  getPasswordRecovery,
  getVerification,
  getAuthStoreActions,
  isAuthenticated,
  isAuthenticating,
  hasAuthError,
  needsVerification,
  isSessionExpired,
  canRefresh,
  needsMfa,
  isHighRisk,
  isSessionValid,
  hasPermission,
  createAuthSelectors,
  type AuthStoreExtensions,
  type AuthStoreState,
  type PatchableAuthStoreState,
  type CreateAuthStoreConfig,
  type AuthStoreActions,
  type AuthStore,
  type InvariantRuleApply,
  type InvariantRule,
  type PersistedAuthStoreState,
} from './auth.js';
