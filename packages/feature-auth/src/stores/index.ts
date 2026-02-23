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
  type AuthStore,
  type AuthStoreActions,
  type AuthStoreExtensions,
  type AuthStoreState,
  authStoreVersion,
  canRefresh,
  createAuthSelectors,
  createAuthStore,
  type CreateAuthStoreConfig,
  createInitialAuthStoreState,
  enforceInvariants,
  getAuth,
  getAuthStoreActions,
  getMfa,
  getOAuth,
  getPasswordRecovery,
  getSecurity,
  getSession,
  getVerification,
  hasAuthError,
  hasPermission,
  type InvariantRule,
  type InvariantRuleApply,
  isAuthenticated,
  isAuthenticating,
  isHighRisk,
  isSessionExpired,
  isSessionValid,
  needsMfa,
  needsVerification,
  type PatchableAuthStoreState,
  type PersistedAuthStoreState,
  restoreAuthFromPersisted,
  validateAuthSemantics,
  validatePersistedState,
  validateSecuritySemantics,
  validateSessionSemantics,
} from './auth.js';
