/**
 * @file packages/feature-auth/src/effects/logout — Logout Effects
 *
 * Публичный API пакета logout effects.
 * Экспортирует все публичные эффекты для logout-flow.
 */

/* ============================================================================
 * 🔐 LOGOUT EFFECT TYPES — DI-КОНТРАКТ ДЛЯ LOGOUT-EFFECT
 * ========================================================================== */

/**
 * Logout Effect DI Types: публичный DI-контракт для logout-effect.
 *
 * @note Общие типы (`AbortControllerPort`, `ClockPort`, `ErrorMapperPort`, `ApiRequestOptions`, `AuthApiClientPort`)
 *       доступны через `./login/index.js` или `./shared/index.js` и не дублируются здесь.
 *
 * @public
 */
export type {
  LogoutAuditLoggerPort,
  LogoutConcurrency,
  LogoutEffectConfig,
  LogoutEffectDeps,
  LogoutFeatureFlags,
  LogoutMode,
  LogoutSecurityDecision,
  LogoutSecurityResult,
} from './logout-effect.types.js';

export {
  isLocalLogoutDeps,
  isRemoteLogoutDeps,
  validateLogoutConfig,
} from './logout-effect.types.js';

/* ============================================================================
 * 📊 LOGOUT STORE UPDATER — ОБНОВЛЕНИЕ СТОРА
 * ========================================================================== */

/**
 * Logout Store Updater: единая точка reset всех состояний аутентификации при logout.
 *
 * @public
 */
export { applyLogoutReset } from './logout-store-updater.js';
